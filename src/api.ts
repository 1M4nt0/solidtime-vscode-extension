import {Logger} from './services/injection'
import {getOrganizationMembers} from './api/organizations/[orgId]/members'
import {getCurrentUser} from './api/users/me'
import type {Member} from './types/entities'

/**
 * Retrieves the current user's membership information for a specific organization.
 */
async function getCurrentUserOrganizationMemberData(orgId: string): Promise<Member> {
  try {
    const response = await getOrganizationMembers({orgId})
    const userId = await getCurrentUser()
    const member = response.data.find((m) => m.user_id === userId.data.id)

    if (!member) throw new Error('Member not found')
    return member
  } catch (error) {
    Logger().log(`get member failed: ${error}`)
    throw error
  }
}

export {getCurrentUserOrganizationMemberData}
