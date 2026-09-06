'use client';
import { useEffect, useRef, useState } from 'react';
import {
  POINTS,
  MILLS,
  newGame,
  count,
  capturable,
  adjacent,
  pointName,
  type Activity,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Music } from '@/components/music';
import { PlayerPicker } from '@/components/player-picker';
export default function Home() {
  const [room, setRoom] = useState<Room | null>(null),
    [roomId, setRoomId] = useState(''),
    [name, setName] = useState(''),
    [spectatorsAllowed, setSpectatorsAllowed] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [connected, setConnected] = useState(false),
    [loaded, setLoaded] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [copied, setCopied] = useState(false),
    [resignOpen, setResignOpen] = useState(false),
    [selectionDirty, setSelectionDirty] = useState(false),
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
          spectatorsAllowed,
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
    pair = room?.players || [],
    myIndex = room?.members.findIndex((m) => m.id === room.you) ?? -1,
    myColor = pair.indexOf(myIndex) + 1,
    playing = game.status === 'playing',
    canPlay =
      playing && myColor === game.turn && !busy && connected && !room?.undo;
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
    : room.undo
      ? '1手戻す返答を待っています'
      : game.status === 'waiting'
        ? '対戦者を選んで、はじめよう。'
        : game.status === 'finished'
          ? game.winner
            ? `${playerName(game.winner)} さんの勝ち`
            : '引き分け'
          : `${playerName(game.turn)} さん、操作してください`;
  const activity = room?.activity;
  const actorName =
    room?.members.find((m) => m.id === activity?.actor)?.name || '';
  function describe(a: Activity | null | undefined) {
    if (!a) return '最初の一手を待っています。';
    if (a.kind === 'start')
      return '対局が始まりました。白の人から駒を置いてください。';
    if (a.kind === 'undo') return '双方の同意で、直前の1手を戻しました。';
    if (a.kind === 'resign') return `${actorName} さんが投了しました。`;
    const step =
      a.to === null
        ? ''
        : a.from === null
          ? `${pointName(a.to)} に駒を置きました`
          : `${pointName(a.from)} → ${pointName(a.to)} に動かしました`;
    return `${actorName} さんが ${step}${a.removed !== undefined ? `。${pointName(a.removed)} の駒を取りました` : a.mill ? '。3つ揃いました！' : ''}`;
  }
  const centerText =
    activity?.kind === 'undo'
      ? '1手戻しました'
      : activity?.kind === 'start'
        ? '対局開始'
        : activity?.kind === 'resign'
          ? '投了'
          : activity?.removed !== undefined
            ? '駒を取りました'
            : activity?.from !== null && activity?.from !== undefined
              ? '動かしました'
              : activity?.to !== null && activity?.to !== undefined
                ? '置きました'
                : '同じ盤を囲もう';
  const instruction = room?.undo
    ? '相手が承認すると盤面が戻ります。返答があるまで操作はお休みです。'
    : game.status === 'finished'
      ? game.reason
      : game.status === 'waiting'
        ? '部屋を作った人が対戦者2人を選び、対局を開始してください。'
        : myColor === 0
          ? `${playerName(game.turn)} さんの手番です。あなたは観戦中です。`
          : myColor !== game.turn
            ? `${playerName(game.turn)} さんが「${phase}」操作をしています。`
            : game.capture
              ? '3つ揃いました！ 光る相手の駒を1つ選んで取ってください。'
              : game.remaining[1] + game.remaining[2] > 0
                ? '光る交点を1つ選んで、駒を置いてください。'
                : selected === null
                  ? '① 動かしたい自分の駒を選んでください。'
                  : '② 光る移動先を選んでください。自分の駒をもう一度押すと選び直せます。';
  function legal(i: number) {
    if (!canPlay) return false;
    if (game.capture) return capturable(game, i);
    if (game.remaining[1] + game.remaining[2] > 0) return !game.board[i];
    if (selected === null)
      return (
        game.board[i] === myColor &&
        (count(game, myColor) === 3 ||
          game.board.some((v, j) => !v && adjacent(i, j)))
      );
    return (
      (game.board[i] === myColor &&
        (count(game, myColor) === 3 ||
          game.board.some((v, j) => !v && adjacent(i, j)))) ||
      (!game.board[i] && (count(game, myColor) === 3 || adjacent(selected, i)))
    );
  }
  function choose(i: number) {
    if (!canPlay) return;
    if (
      !game.capture &&
      game.remaining[1] + game.remaining[2] === 0 &&
      game.board[i] === myColor &&
      legal(i)
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
        <Music />
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
          {room && (
            <div className="turn-guide" aria-live="polite">
              <span className="turn-badge">
                {game.status === 'waiting'
                  ? '準備'
                  : game.status === 'finished'
                    ? '終了'
                    : room.undo
                      ? '確認中'
                      : myColor === game.turn
                        ? 'あなたの番'
                        : '手番'}
              </span>
              <div>
                <strong>
                  {playing
                    ? `${playerName(game.turn)} さん：${phase}`
                    : game.status === 'finished'
                      ? '対局が終了しました'
                      : !room.spectatorsAllowed
                        ? '2人で対戦'
                        : '2人で対戦・観戦席あり'}
                </strong>
                <p>{instruction}</p>
              </div>
            </div>
          )}
          {room?.undo && (
            <div className="undo-panel" role="status">
              <strong>
                {room.members.find((m) => m.id === room.undo?.requester)?.name}{' '}
                さんが1手戻すことを希望しています
              </strong>
              <p>ミルを作った手は、駒取りもまとめて戻します。</p>
              {myColor > 0 && (
                <div className="undo-buttons">
                  {room.undo.requester === room.you ? (
                    <button
                      className="secondary"
                      disabled={busy || !connected}
                      onClick={() => void action('undo-cancel')}
                    >
                      申請を取り消す
                    </button>
                  ) : (
                    <>
                      <button
                        className="primary"
                        disabled={busy || !connected}
                        onClick={() => void action('undo-approve')}
                      >
                        同意して1手戻す
                      </button>
                      <button
                        className="secondary"
                        disabled={busy || !connected}
                        onClick={() => void action('undo-reject')}
                      >
                        戻さず続ける
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="activity-strip" aria-live="polite">
            <span>直前の一手</span>
            <p>{describe(activity)}</p>
          </div>
          <div className="board">
            <svg viewBox="-0.5 -0.5 7 7" aria-hidden="true">
              <defs>
                <marker
                  id="move-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10Z" fill="#e6fa92" />
                </marker>
              </defs>
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
              {activity?.from !== null &&
                activity?.from !== undefined &&
                activity.to !== null && (
                  <g className="move-trail" key={JSON.stringify(activity)}>
                    <circle
                      cx={POINTS[activity.from][0]}
                      cy={POINTS[activity.from][1]}
                      r=".21"
                      fill="none"
                      stroke="#e6fa92"
                      strokeWidth=".025"
                      strokeDasharray=".06 .045"
                    />
                    <line
                      x1={POINTS[activity.from][0]}
                      y1={POINTS[activity.from][1]}
                      x2={POINTS[activity.to][0]}
                      y2={POINTS[activity.to][1]}
                      stroke="#e6fa92"
                      strokeWidth=".045"
                      strokeDasharray=".10 .07"
                      markerEnd="url(#move-arrow)"
                    />
                  </g>
                )}
              {POINTS.map(([x, y], i) => (
                <text
                  key={`label-${i}`}
                  x={x + 0.18}
                  y={y + 0.33}
                  className="point-label"
                >
                  {pointName(i)}
                </text>
              ))}
            </svg>
            <div className="board-controls">
              {POINTS.map(([x, y], i) => (
                <button
                  key={i}
                  className={`node stone-${game.board[i]} ${selected === i ? 'selected' : ''} ${legal(i) ? 'legal' : ''} ${activity?.to === i ? 'latest-destination' : ''} ${activity?.removed === i ? 'removed' : ''} ${game.capture && game.board[i] === 3 - game.turn && !capturable(game, i) ? 'protected' : ''}`}
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
            <div className="board-center" key={JSON.stringify(activity)}>
              <span className="center-actor">
                {actorName ? `${actorName} さん` : 'MORRIS'}
              </span>
              <strong>{centerText}</strong>
              <span>
                {activity?.to !== null && activity?.to !== undefined
                  ? `${activity.from !== null ? pointName(activity.from) + ' → ' : ''}${pointName(activity.to)}`
                  : ''}
              </span>
              {playing && <small>次：{playerName(game.turn)} さん</small>}
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
          {playing && game.capture && (
            <p className="capture-help">
              <strong>取れる駒が光っています。</strong>{' '}
              3つ並んだ駒（ミル）は保護されています。ただし相手の駒が全部ミルに入っていれば、どれでも取れます。
            </p>
          )}
          {room?.you && myColor > 0 && game.status !== 'waiting' && (
            <div className="undo-control">
              <button
                className="secondary"
                disabled={busy || !connected || !room.canUndo || !!room.undo}
                onClick={() => void action('undo-request')}
              >
                ↶ 1手戻すことを申請
              </button>
              <span>対戦する2人の同意で戻します</span>
            </div>
          )}
        </section>
        <aside>
          {!room?.you ? (
            <>
              <p className="eyebrow">PLAY TOGETHER</p>
              <h2>{roomId ? '対戦室へようこそ。' : '一緒に、ひと勝負。'}</h2>
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
                {!roomId && (
                  <div className="room-mode">
                    <label id="room-mode-label">観戦の設定</label>
                    <Select
                      value={spectatorsAllowed}
                      onValueChange={(value) => {
                        if (typeof value === 'boolean')
                          setSpectatorsAllowed(value);
                      }}
                      disabled={busy}
                      items={[
                        { value: false, label: '対戦者2人のみ' },
                        { value: true, label: '観戦あり・人数制限なし' },
                      ]}
                    >
                      <SelectTrigger aria-labelledby="room-mode-label">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={false}>対戦者2人のみ</SelectItem>
                        <SelectItem value={true}>
                          観戦あり・人数制限なし
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="muted">
                      {!spectatorsAllowed
                        ? '対戦相手を1人招待して遊べます。'
                        : '対戦者2人が揃えば開始できます。観戦者はあとから参加できます。'}
                    </p>
                  </div>
                )}
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
                {(room?.spectatorsAllowed ?? spectatorsAllowed) && (
                  <>
                    <br />◉ 観戦人数の制限なし
                  </>
                )}
                <br />☑ 部屋を作った人が対戦者を選択
              </div>
            </>
          ) : (
            <>
              <div className="side-title">
                <p className="eyebrow">AT THE TABLE</p>
                <span>参加 {room.members.length}人</span>
              </div>
              {(pair.length === 2
                ? [
                    ...pair,
                    ...Array.from(
                      { length: Math.max(2, room.members.length) },
                      (_, i) => i,
                    ).filter((i) => !pair.includes(i)),
                  ]
                : Array.from(
                    { length: Math.max(2, room.members.length) },
                    (_, i) => i,
                  )
              ).map((idx, rank) => {
                const m = room.members[idx];
                return (
                  <div
                    className={`player-card ${playing && game.turn === rank + 1 && pair.length === 2 ? 'active' : ''}`}
                    key={idx}
                  >
                    <div className={`avatar avatar-${Math.min(rank + 1, 3)}`}>
                      {pair.length !== 2
                        ? '○'
                        : rank === 0
                          ? '●'
                          : rank === 1
                            ? '◆'
                            : '◉'}
                    </div>
                    <div>
                      <div className="player-name">
                        {m?.name ||
                          (rank >= 2 && pair.length === 2
                            ? '観戦席（空席）'
                            : '参加待ち')}{' '}
                        {m?.id === room.you && <small>あなた</small>}
                      </div>
                      <div className="player-meta">
                        {pair.length !== 2
                          ? '役割を選んでください'
                          : rank >= 2
                            ? '観戦'
                            : `${rank === 0 ? '白 · 先手' : '琥珀 · 後手'}　盤上 ${count(game, rank + 1)} / 手元 ${game.remaining[rank + 1]}`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {myIndex === 0 && game.status !== 'playing' && (
                <PlayerPicker
                  onDirty={setSelectionDirty}
                  room={room}
                  busy={busy || !connected || !!room.undo}
                  onSave={(players) =>
                    void action('select-players', { players })
                  }
                />
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
                <p>
                  {room.spectatorsAllowed
                    ? '観戦する人にもこのURLを送れます。観戦人数に上限はありません。'
                    : room.members.length < 2
                      ? '対戦相手にこのURLを送ってください。'
                      : '参加済みの人は、このURLから戻れます。'}
                </p>
              </div>
              {game.status !== 'playing' &&
                (myIndex === 0 ? (
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      selectionDirty ||
                      room.members.length < 2 ||
                      room.nextPlayers.length !== 2 ||
                      !connected ||
                      !!room.undo
                    }
                    onClick={() => void action('start')}
                  >
                    {room.members.length < 2
                      ? 'あと' +
                        (2 - room.members.length) +
                        '人の参加を待っています'
                      : game.status === 'finished'
                        ? '選んだ2人で、次の対局へ →'
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
                  <AlertDialogTrigger
                    className="text-button"
                    disabled={busy || !connected || !!room.undo}
                  >
                    この対局を投了する
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>投了しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      相手の勝ちでこの対局を終了します。次の対戦者は部屋を作った人が選べます。
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
                線の上に自分の駒を3個並べると「ミル」。相手の駒を1個取れます。ミル内の駒は保護されますが、相手の駒が全てミル内ならどれでも取れます。
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
              対戦者2人は部屋を作った人が選びます。「観戦あり」の部屋では、対戦者以外の参加者が何人でも観戦できます。対局中の変更はできません。1手戻すには、申請した人と相手の同意が必要です（直近40手まで）。再接続は同じブラウザでこのURLを開いてください。
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
