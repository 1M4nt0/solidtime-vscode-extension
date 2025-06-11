import {API} from '../../../../../services/injection'
import { DateUtils } from '../../../../../functions/date'
import type {APIResponse, FetchAPI} from '../../../../../types/api'
import type {TimeEntry} from '../../../../../types/entities'
import type { Nullable } from '../../../../../types/utils'

type RequestUpdateTimeEntryParams = {
  orgId: string
  entryId: string
}

type RequestUpdateTimeEntryBody = {
  member_id?: string
  start?: Date
  end?: Date
  billable?: boolean
  project_id?: Nullable<string>
  description?: Nullable<string>
  tags?: Array<Nullable<string>>
  task_id?: Nullable<string>
}

type UpdateTimeEntryResponse = APIResponse<TimeEntry[]>

const updateTimeEntry: FetchAPI<UpdateTimeEntryResponse, [RequestUpdateTimeEntryParams, RequestUpdateTimeEntryBody]> = (
  params,
  body
) => {
  return API().request<UpdateTimeEntryResponse>(`/organizations/${params.orgId}/time-entries/${params.entryId}`, {
    method: 'PUT',
    body: {
      ...body,
      start: body.start ? DateUtils.formatUTCTimeZone(body.start, DateUtils.UTC_DATE_TIME_FORMAT) : undefined,
      end: body.end ? DateUtils.formatUTCTimeZone(body.end, DateUtils.UTC_DATE_TIME_FORMAT) : undefined,
    },
  })
}

export {updateTimeEntry}
