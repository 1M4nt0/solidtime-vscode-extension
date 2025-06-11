import {startOfDay, endOfDay, subMilliseconds, differenceInMilliseconds} from 'date-fns'
import {formatInTimeZone, toZonedTime} from 'date-fns-tz'

class DateUtils {
  static DATE_FORMAT = 'yyyy-mm-dd'
  static UTC_DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'"

  static now(): Date {
    return new Date()
  }

  static formatUTCTimeZone(date: Date, format: string): string {
    return formatInTimeZone(date, 'UTC', format)
  }

  static parseUTCtoZonedTime(date: string): Date {
    return toZonedTime(date, Intl.DateTimeFormat().resolvedOptions().timeZone)
  }

  static startOfDay(date: Date): Date {
    return startOfDay(date)
  }

  static endOfDay(date: Date): Date {
    return endOfDay(date)
  }

  static subMilliseconds(date: Date, milliseconds: number): Date {
    return subMilliseconds(date, milliseconds)
  }

  static differenceInMilliseconds(date1: Date, date2: Date): number {
    return differenceInMilliseconds(date1, date2)
  }
}

export {DateUtils}
