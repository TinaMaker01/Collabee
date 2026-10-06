import { EventEmitter } from 'node:events'

class NotificationEventEmitter extends EventEmitter {}

export const notificationEvents = new NotificationEventEmitter()

export function emitNotification(userId: number, payload: unknown) {
  notificationEvents.emit(`user:${userId}`, payload)
}
