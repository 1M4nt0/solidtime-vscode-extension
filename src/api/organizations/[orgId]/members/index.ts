import {API} from '../../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {Member} from '../../../../types/entities'

type RequestOrganizationMembersParams = {
  orgId: string
}

type MembersResponse = APIResponse<Member[]>

const getOrganizationMembers: FetchAPI<MembersResponse, [RequestOrganizationMembersParams]> = (params) => {
  return API().request(`/organizations/${params.orgId}/members`, {
    method: 'GET',
  })
}

export {getOrganizationMembers}
