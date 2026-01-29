import handler from '../server/handler.js'

export default function vercelHandler(req, res) {
  return handler(req, res)
}
