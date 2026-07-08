type ErrorPanelProps = {
  message?: string
  details?: string
}

export function ErrorPanel({ message, details }: ErrorPanelProps) {
  if (!message) {
    return null
  }

  return (
    <section className="notice notice-danger" role="alert">
      <strong>{message}</strong>
      {details ? <p>{details}</p> : null}
    </section>
  )
}
