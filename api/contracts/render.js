import { handleContractRenderRequest } from '../../server/contracts.js'

export default async function handler(req, res) {
  await handleContractRenderRequest(req, res)
}
