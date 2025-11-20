import { handleLeasingContractsRequest } from '../../server/leasingContracts.js'

export default async function handler(req, res) {
  await handleLeasingContractsRequest(req, res)
}
