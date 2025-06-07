import {API} from '../../../../../services/injection'
import type {APIResponse, FetchAPI} from '../../../../../types/api'
import type {Project} from '../../../../../types/entities'

type RequestGetOrganizationProjectsParams = {
  orgId: string
  projectId: string
}

type GetOrganizationProjectsResponse = APIResponse<Project[]>

const getOrganizationProject: FetchAPI<GetOrganizationProjectsResponse, [RequestGetOrganizationProjectsParams]> = (params) => {
  return API().request(`/organizations/${params.orgId}/projects/${params.projectId}`, {
    method: 'GET',
  })
}

export {getOrganizationProject}
