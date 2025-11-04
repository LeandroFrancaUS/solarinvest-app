import { handleContractTemplatesRequest } from '../../server/contracts.js'

export default async function handler(req, res) {
  await handleContractTemplatesRequest(req, res)
}
