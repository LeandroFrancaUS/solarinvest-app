import './flows.css'

interface InlineValidationBarProps {
  messages: string[]
}

export function InlineValidationBar({ messages }: InlineValidationBarProps) {
  if (messages.length === 0) return null
  return (
    <div className="inline-validation">
      <strong>Pendências:</strong>
      <ul>
        {messages.map((msg) => (
          <li key={msg}>{msg}</li>
        ))}
      </ul>
    </div>
  )
}
