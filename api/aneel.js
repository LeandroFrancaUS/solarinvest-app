import { handleAneelProxyRequest } from '../server/aneelProxy.js'

export default async function handler(req, res) {
  await handleAneelProxyRequest(req, res)
}
