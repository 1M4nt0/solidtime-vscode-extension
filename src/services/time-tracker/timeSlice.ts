class TimeSlice {
  private readonly _startedAt: Date
  private _endedAt?: Date
  private _remoteId?: string

  constructor({startedAt, endedAt, remoteId}: {startedAt: Date; endedAt?: Date; remoteId?: string}) {
    this._startedAt = startedAt
    this._endedAt = endedAt
    this._remoteId = remoteId
  }

  get startedAt(): Date {
    return this._startedAt
  }

  get endedAt(): Date | undefined {
    return this._endedAt
  }

  get remoteId(): string | undefined {
    return this._remoteId
  }

  copyWith({startedAt, endedAt, remoteId}: {startedAt?: Date; endedAt?: Date; remoteId?: string}): TimeSlice {
    return new TimeSlice({
      startedAt: startedAt ?? this._startedAt,
      endedAt: endedAt ?? this._endedAt,
      remoteId: remoteId ?? this._remoteId,
    })
  }
}

export {TimeSlice}
