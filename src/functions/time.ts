import {startOfDay, endOfDay, format, subMilliseconds, parse} from 'date-fns'

class DateUtils {
  static DATE_FORMAT = 'yyyy-mm-dd'
  static UTC_DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'"

  static now(): Date {
    return new Date()
  }

  static startOfDay(date: Date): Date {
    return startOfDay(date)
  }

  static endOfDay(date: Date): Date {
    return endOfDay(date)
  }

  static format(date: Date, formatStr: string): string {
    return format(date, formatStr)
  }

  static parse(date: string, formatStr: string): Date {
    return parse(date, formatStr, new Date())
  }

  static subMilliseconds(date: Date, milliseconds: number): Date {
    return subMilliseconds(date, milliseconds)
  }
}

export {DateUtils}
