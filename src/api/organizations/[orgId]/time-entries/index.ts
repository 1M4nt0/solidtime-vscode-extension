import {API} from '../../../../services/injection'
import {DateUtils} from '../../../../functions/date'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {TimeEntry} from '../../../../types/entities'
import type {Nullable} from '../../../../types/utils'

type RequestGetOrganizationTimeEntriesParams = {
  orgId: string
  start?: Nullable<Date>
  end?: Nullable<Date>
  project_ids?: string[]
}

type GetOrganizationTimeEntriesResponse = APIResponse<TimeEntry[]>

const getOrganizationTimeEntries: FetchAPI<
  GetOrganizationTimeEntriesResponse,
  [RequestGetOrganizationTimeEntriesParams]
> = (params) => {
  return API().request(`/organizations/${params.orgId}/time-entries`, {
    method: 'GET',
    searchParams: {
      start: params.start ? DateUtils.formatUTCTimeZone(params.start, DateUtils.UTC_DATE_TIME_FORMAT) : undefined,
      end: params.end ? DateUtils.formatUTCTimeZone(params.end, DateUtils.UTC_DATE_TIME_FORMAT) : undefined,
      project_ids: params.project_ids,
    },
  })
}

export {getOrganizationTimeEntries}
