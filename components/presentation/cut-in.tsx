import type { ActiveEffect } from '@/lib/presentation/director';
export function CutIn({ effect }: { effect: ActiveEffect }) {
  return (
    <div className="fx-cutin">
      <div className="fx-sash">
        <div className="fx-sash-ink" />
        <div className="fx-cutin-content">
          <span className="fx-kicker">THREE IN LINE</span>
          <strong className="fx-title">
            MILL<span className="fx-title-dot">!</span>
          </strong>
          <span className="fx-player">
            <span>{effect.event.player === 1 ? '● WHITE' : '◆ AMBER'}</span>
            <b>{effect.event.actorName}</b>
          </span>
        </div>
        <span className="fx-slash fx-slash-one" />
        <span className="fx-slash fx-slash-two" />
      </div>
    </div>
  );
}
