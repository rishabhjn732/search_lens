import type { Problem } from '../../wordlists/rules';

export interface MessageData {
  kind: 'ok' | 'err';
  title: string;
  items?: (Problem & { warn?: boolean })[];
}

// A green or red box with up to 5 problems, then "… and N more." (R1.2).
export default function Message({ msg }: { msg: MessageData }) {
  const items = msg.items ?? [];
  return (
    <div className={`msg ${msg.kind}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
      <b>{msg.title}</b>
      {items.length > 0 && (
        <ul>
          {items.slice(0, 5).map((it, i) => (
            <li key={i} className={it.warn ? 'warn' : undefined}>
              {it.line > 0 && <span className="ln">Line {it.line}: </span>}
              {it.msg}
            </li>
          ))}
          {items.length > 5 && <li>… and {items.length - 5} more.</li>}
        </ul>
      )}
    </div>
  );
}
