interface LevelOutroModalProps {
  text: string;
  onRestart: () => void;
  onLobby: () => void;
}

export function LevelOutroModal({ text, onRestart, onLobby }: LevelOutroModalProps) {
  return (
    <div className="level-popup" role="dialog" aria-modal="true" aria-labelledby="level-outro-title">
      <div className="level-card level-card-celebrate">
        <div className="won-icon outro">🎉</div>
        <h2 id="level-outro-title">完成全部关卡!</h2>
        <p>{text}</p>
        <div className="level-card-actions">
          <button className="level-btn level-btn-primary" type="button" onClick={onRestart}>
            ↻ 重新开始
          </button>
          <button className="level-btn level-btn-ghost" type="button" onClick={onLobby}>
            回到主菜单
          </button>
        </div>
      </div>
    </div>
  );
}
