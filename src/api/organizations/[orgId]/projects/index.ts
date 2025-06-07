import {API} from '../../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {Project} from '../../../../types/entities'

type RequestGetOrganizationProjectsParams = {
  orgId: string
}

type GetOrganizationProjectsResponse = APIResponse<Project[]>

const getOrganizationProjects: FetchAPI<GetOrganizationProjectsResponse, [RequestGetOrganizationProjectsParams]> = (params) => {
  return API().request(`/organizations/${params.orgId}/projects`, {
    method: 'GET',
  })
}

export {getOrganizationProjects}
