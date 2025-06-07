import {API} from '../../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {Membership} from '../../../../types/entities'

type GetCurrentUserMembershipResponse = APIResponse<Membership[]>

const getCurrentUserMembership: FetchAPI<GetCurrentUserMembershipResponse> = () => {
  return API().request(`/users/me/memberships`, {
    method: 'GET',
  })
}

export {getCurrentUserMembership}
