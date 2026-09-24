import { STATUS_LABEL, type StatusSac } from '../types';

export default function StatusBadge({ status }: { status: StatusSac }) {
  return <span className={`badge st-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}
