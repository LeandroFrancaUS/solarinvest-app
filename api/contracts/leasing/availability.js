import { handleLeasingContractsAvailabilityRequest } from '../../../server/leasingContracts.js'

export default async function handler(req, res) {
  await handleLeasingContractsAvailabilityRequest(req, res)
}
