export function getLogger(name: string)
{
  return {
    trace: console.trace.bind(console, name),
    info: console.info.bind(console, name),
    log: console.log.bind(console, name),
    warn: console.warn.bind(console, name),
    error: console.error.bind(console, name),
  }
}