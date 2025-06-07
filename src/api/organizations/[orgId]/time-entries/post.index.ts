import {API} from '../../../../services/injection'
import {DateUtils} from '../../../../functions/time'
import type {APIResponse, FetchAPI} from '../../../../types/api'
import type {TimeEntry} from '../../../../types/entities'
import type {Nullable} from '../../../../types/utils'

type RequestCreateTimeEntryBody = {
  member_id: string
  start: Date
  end?: Date
  billable: boolean
  project_id?: Nullable<string>
  description?: Nullable<string>
  tags?: Array<Nullable<string>>
  task_id?: Nullable<string>
}

type RequestCreateTimeEntryParams = {
  orgId: string
}

type CreateTimeEntryResponse = APIResponse<TimeEntry>

const createTimeEntry: FetchAPI<CreateTimeEntryResponse, [RequestCreateTimeEntryParams, RequestCreateTimeEntryBody]> = (
  params,
  body
) => {
  return API().request(`/organizations/${params.orgId}/time-entries`, {
    method: 'POST',
    body: {
      ...body,
      start: DateUtils.format(body.start, DateUtils.UTC_DATE_TIME_FORMAT),
      end: body.end ? DateUtils.format(body.end, DateUtils.UTC_DATE_TIME_FORMAT) : undefined,
    },
  })
}

export {createTimeEntry}
export type {RequestCreateTimeEntryBody}
