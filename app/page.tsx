'use client';
import { useEffect, useRef, useState } from 'react';
import {
  POINTS,
  MILLS,
  newGame,
  count,
  capturable,
  adjacent,
  seats,
  type Room,
} from '@/lib/game';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
export default function Home() {
  const [room, setRoom] = useState<Room | null>(null),
    [roomId, setRoomId] = useState(''),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [copied, setCopied] = useState(false),
    [resignOpen, setResignOpen] = useState(false),
    [url, setUrl] = useState('');
  const latest = useRef(-1);
  function accept(data: Room) {
    if (data.revision < latest.current) return;
    if (data.revision !== latest.current) setSelected(null);
    latest.current = data.revision;
    setRoom(data);
    setConnected(true);
  }
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('room') || '';
    setRoomId(id);
    setUrl(window.location.href);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!roomId) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function sync() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(`/api/rooms?id=${encodeURIComponent(roomId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = (await res.json()) as Room & { error?: string };
        if (stop) return;
        if (!res.ok) {
          setError(data.error || '部屋を読み込めませんでした');
          setConnected(false);
        } else accept(data);
      } catch {
        if (!stop) setConnected(false);
      } finally {
        clearTimeout(timeout);
        if (!stop) timer = setTimeout(sync, 1200);
      }
    }
    void sync();
    return () => {
      stop = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [roomId]);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id: roomId,
          name,
          revision: room?.revision,
          ...extra,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const data = (await res.json()) as Room & { error?: string };
      if (!res.ok) throw Error(data.error || '操作に失敗しました');
      if (action === 'create') {
        latest.current = -1;
        const next = `${window.location.origin}/?room=${data.id}`;
        window.history.replaceState(null, '', next);
        setUrl(next);
        setRoomId(data.id);
      }
      accept(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信に失敗しました');
    } finally {
      setBusy(false);
    }
  }
  const game = room?.game || newGame(),
    pair = seats(room?.round || 1),
    myIndex = room?.members.findIndex((m) => m.id === room.you) ?? -1,
    myColor = pair.indexOf(myIndex) + 1,
    playing = game.status === 'playing',
    canPlay = playing && myColor === game.turn && !busy && connected;
  const playerName = (color: number) =>
    room?.members[pair[color - 1]]?.name || '参加待ち';
  const phase = game.capture
    ? '相手の駒を1つ取る'
    : game.remaining[1] + game.remaining[2] > 0
      ? '駒を置く'
      : count(game, game.turn) === 3
        ? '好きな空き交点へ飛ぶ'
        : '駒を動かす';
  const heading = !room
    ? 'さあ、盤を囲もう。'
    : game.status === 'waiting'
      ? '3人で、準備をしよう。'
      : game.status === 'finished'
        ? game.winner
          ? `${playerName(game.winner)} の勝ち`
          : '引き分け'
        : canPlay
          ? 'あなたの一手です。'
          : `${playerName(game.turn)} の手番`;
  function legal(i: number) {
    if (!canPlay) return false;
    if (game.capture) return capturable(game, i);
    if (game.remaining[1] + game.remaining[2] > 0) return !game.board[i];
    if (selected === null) return game.board[i] === myColor;
    return (
      game.board[i] === myColor ||
      (!game.board[i] && (count(game, myColor) === 3 || adjacent(selected, i)))
    );
  }
  function choose(i: number) {
    if (!canPlay) return;
    if (
      !game.capture &&
      game.remaining[1] + game.remaining[2] === 0 &&
      game.board[i] === myColor
    ) {
      setSelected(selected === i ? null : i);
      return;
    }
    if (legal(i)) void action('move', { from: selected, to: i });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('下のURLを選択してコピーしてください');
    }
  }
  return (
    <main className="shell">
      <header>
        <a className="brand" href="/">
          ▣ MORRIS<span>ナインメンズモリス</span>
        </a>
        <span className="pill">2人対戦 · 1人観戦</span>
      </header>
      <div className="game-layout">
        <section>
          <div className="board-heading">
            <div>
              <p className="eyebrow">
                {room
                  ? `ROUND ${String(room.round).padStart(2, '0')} / 対戦室`
                  : 'THE TABLE / 対戦室'}
              </p>
              <h1 aria-live="polite">{heading}</h1>
            </div>
            <span className="round">
              {String(room?.round || 1).padStart(2, '0')}
            </span>
          </div>
          <div className="board">
            <svg viewBox="-0.5 -0.5 7 7" aria-hidden="true">
              {[0, 1, 2].map((n) => (
                <rect
                  key={n}
                  x={n}
                  y={n}
                  width={6 - n * 2}
                  height={6 - n * 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth=".025"
                />
              ))}
              <path
                d="M3 0V2 M0 3H2 M4 3H6 M3 4V6"
                stroke="currentColor"
                strokeWidth=".025"
              />
              {MILLS.filter(
                (m) =>
                  game.board[m[0]] &&
                  m.every((i) => game.board[i] === game.board[m[0]]),
              ).map((m, i) => (
                <line
                  key={i}
                  x1={POINTS[m[0]][0]}
                  y1={POINTS[m[0]][1]}
                  x2={POINTS[m[2]][0]}
                  y2={POINTS[m[2]][1]}
                  stroke={game.board[m[0]] === 1 ? '#e9f3d8' : '#e6aa67'}
                  strokeWidth=".045"
                />
              ))}
              {POINTS.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r=".065" fill="currentColor" />
              ))}
            </svg>
            <div className="board-controls">
              {POINTS.map(([x, y], i) => (
                <button
                  key={i}
                  className={`node stone-${game.board[i]} ${selected === i ? 'selected' : ''} ${legal(i) ? 'legal' : ''} ${game.last === i ? 'last' : ''}`}
                  style={{
                    left: `${((x + 0.5) / 7) * 100}%`,
                    top: `${((y + 0.5) / 7) * 100}%`,
                  }}
                  disabled={!legal(i)}
                  onClick={() => choose(i)}
                  aria-pressed={selected === i}
                  aria-label={`${String.fromCharCode(65 + x)}${7 - y}：${game.board[i] === 1 ? '白の駒' : game.board[i] === 2 ? '琥珀の駒' : '空き交点'}${game.capture && legal(i) ? '、取る' : ''}`}
                >
                  <span>
                    {game.board[i] === 1 ? '●' : game.board[i] === 2 ? '◆' : ''}
                  </span>
                </button>
              ))}
            </div>
            <div className="board-caption">NINE MEN’S MORRIS</div>
          </div>
          <div className="status-bar">
            <span className={`dot ${connected ? 'online' : ''}`} />
            <span>
              {room
                ? connected
                  ? '全員の盤面を同期中'
                  : '再接続しています…'
                : '同じURLで、同じ盤面を。'}
            </span>
            {playing && <strong>{phase}</strong>}
          </div>
          {room && (
            <p className="instruction">
              {game.status === 'finished'
                ? game.reason
                : game.status === 'waiting'
                  ? '名前を入れて参加したら、部屋を作った人が対局を開始できます。'
                  : myColor === 0
                    ? '観戦中です。次の対局で交代します。'
                    : canPlay
                      ? game.capture
                        ? '3つ揃いました。相手の駒を1つ選んで取ってください。'
                        : game.remaining[1] + game.remaining[2] > 0
                          ? '光る交点を選んで、駒を置いてください。'
                          : selected === null
                            ? '動かしたい自分の駒を選んでください。'
                            : '移動先の光る交点を選んでください。'
                      : '相手の一手を待っています。'}
            </p>
          )}
        </section>
        <aside>
          {!room?.you ? (
            <>
              <p className="eyebrow">PLAY TOGETHER</p>
              <h2>{roomId ? '対戦室へようこそ。' : 'いつもの3人で。'}</h2>
              <p className="muted">
                {roomId
                  ? '名前を入れて、この部屋に参加しましょう。'
                  : '部屋のURLを共有すると、全員に同じ盤面が表示されます。'}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(roomId ? 'join' : 'create');
                }}
              >
                <label htmlFor="name">あなたの名前</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名前を入力"
                  maxLength={20}
                  required
                  autoComplete="nickname"
                />
                <button
                  className="primary"
                  disabled={
                    !loaded || busy || !name.trim() || Boolean(roomId && !room)
                  }
                >
                  {busy
                    ? '接続中…'
                    : roomId
                      ? 'この部屋に参加する ↗'
                      : '部屋をつくる ↗'}
                </button>
              </form>
              <div className="seats">
                ● 対戦する2人
                <br />◉ 観戦する1人
                <br />↻ 対局ごとに交代
              </div>
            </>
          ) : (
            <>
              <div className="side-title">
                <p className="eyebrow">AT THE TABLE</p>
                <span>{room.members.length} / 3</span>
              </div>
              {[...pair, [0, 1, 2].find((i) => !pair.includes(i))!].map(
                (idx, rank) => {
                  const m = room.members[idx];
                  return (
                    <div
                      className={`player-card ${playing && game.turn === rank + 1 ? 'active' : ''}`}
                      key={idx}
                    >
                      <div className={`avatar avatar-${rank + 1}`}>
                        {rank === 0 ? '●' : rank === 1 ? '◆' : '◉'}
                      </div>
                      <div>
                        <div className="player-name">
                          {m?.name || '参加待ち'}{' '}
                          {m?.id === room.you && <small>あなた</small>}
                        </div>
                        <div className="player-meta">
                          {rank === 2
                            ? '観戦 / 次局で交代'
                            : `${rank === 0 ? '白 · 先手' : '琥珀 · 後手'}　盤上 ${count(game, rank + 1)} / 手元 ${game.remaining[rank + 1]}`}
                        </div>
                      </div>
                    </div>
                  );
                },
              )}
              <div className="invite">
                <button className="secondary" onClick={() => void copy()}>
                  {copied ? '✓ URLをコピーしました' : '↗ 招待URLをコピー'}
                </button>
                <label className="sr-only" htmlFor="room-url">
                  招待URL
                </label>
                <input
                  id="room-url"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  className="url"
                />
                <p>このURLをあと2人に送ってください。</p>
              </div>
              {game.status !== 'playing' &&
                (myIndex === 0 ? (
                  <button
                    className="primary"
                    disabled={busy || room.members.length < 3 || !connected}
                    onClick={() => void action('start')}
                  >
                    {room.members.length < 3
                      ? 'あと' +
                        (3 - room.members.length) +
                        '人の参加を待っています'
                      : game.status === 'finished'
                        ? '交代して、次の対局へ →'
                        : '対局をはじめる →'}
                  </button>
                ) : (
                  <p className="muted">
                    {room.members[0].name} が
                    {game.status === 'finished' ? '次の対局を' : '対局を'}
                    始めるのを待っています。
                  </p>
                ))}
              {playing && myColor > 0 && (
                <AlertDialog open={resignOpen} onOpenChange={setResignOpen}>
                  <AlertDialogTrigger className="text-button" disabled={busy}>
                    この対局を投了する
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>投了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      相手の勝ちでこの対局を終了します。次の対局では観戦者と交代します。
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>続ける</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          setResignOpen(false);
                          void action('resign');
                        }}
                      >
                        投了する
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <details className="rules">
            <summary>遊び方と、この部屋のルール</summary>
            <ol>
              <li>交互に9個ずつ駒を置きます。</li>
              <li>
                線の上に自分の駒を3個並べると「ミル」。相手の駒を1個取れます。ミル外の駒を優先します。
              </li>
              <li>
                全て置いたら、線でつながる隣の交点へ移動。自分の駒が3個なら、空いた交点へ自由に飛べます。
              </li>
              <li>相手の駒を2個以下にするか、動けなくすると勝ち。</li>
              <li>
                同一盤面・手番が3回、または捕獲なしで50往復すると引き分け。
              </li>
            </ol>
            <p>
              組み合わせは参加順で 1–2 → 2–3 → 3–1
              と交代。再接続は同じブラウザでこのURLを開いてください。
            </p>
            <a
              href="https://www.flyordie.com/mill/rules"
              target="_blank"
              rel="noreferrer"
            >
              基本ルールの参考 ↗
            </a>
          </details>
        </aside>
      </div>
      <footer>9つの駒、24の交点。3つ並べて、次の一手へ。</footer>
    </main>
  );
}
