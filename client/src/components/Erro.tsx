export default function Erro({ msg }: { msg: string | null }) {
  return msg ? <div className="alerta erro">{msg}</div> : null;
}
