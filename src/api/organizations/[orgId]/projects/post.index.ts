import {API} from '../../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {Project} from '../../../../types/entities'

type RequestCreateOrganizationProjectBody = {
  name: string
  color: string
  is_billable: boolean
  member_ids: string[]
  client_id: string | null
}

type RequestCreateOrganizationProjectParams = {
  orgId: string
}

type CreateOrganizationProjectResponse = APIResponse<Project>

const createOrganizationProject: FetchAPI<
  CreateOrganizationProjectResponse,
  [RequestCreateOrganizationProjectParams, RequestCreateOrganizationProjectBody]
> = (params, body) => {
  return API().request(`/organizations/${params.orgId}/projects`, {
    method: 'POST',
    body,
  })
}

export {createOrganizationProject}
