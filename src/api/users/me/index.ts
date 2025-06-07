import {API} from '../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../types/api'
import type {User} from '../../../types/entities'

type GetCurrentUserResponse = APIResponse<User>

const getCurrentUser: FetchAPI<GetCurrentUserResponse> = () => {
  return API().request(`/users/me`, {
    method: 'GET',
  })
}

export {getCurrentUser}
