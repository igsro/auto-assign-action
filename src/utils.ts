import _ from 'lodash'
import * as github from '@actions/github'
import * as yaml from 'js-yaml'
import { Config } from './handler'

export function chooseReviewers(owner: string, config: Config): string[] {
  const {
    useReviewGroups,
    useFoundReviewGroup,
    reviewGroups,
    numberOfReviewers,
    reviewers,
  } = config

  let chosenReviewers: string[] = []
  const useGroups: boolean =
    useReviewGroups && Object.keys(reviewGroups).length > 0

  if (useGroups) {
    chosenReviewers = chooseUsersFromGroups(
      owner,
      reviewGroups,
      numberOfReviewers,
      useFoundReviewGroup
    )
  } else {
    chosenReviewers = chooseUsers(reviewers, numberOfReviewers, owner)
  }

  return chosenReviewers
}

export function chooseAssignees(owner: string, config: Config): string[] {
  const {
    useAssigneeGroups,
    useFoundAssigneeGroup,
    assigneeGroups,
    addAssignees,
    numberOfAssignees,
    numberOfReviewers,
    assignees,
    reviewers,
  } = config
  let chosenAssignees: string[] = []

  const useGroups: boolean =
    useAssigneeGroups && Object.keys(assigneeGroups).length > 0

  if (typeof addAssignees === 'string') {
    if (addAssignees !== 'author') {
      throw new Error(
        "Error in configuration file to do with using addAssignees. Expected 'addAssignees' variable to be either boolean or 'author'"
      )
    }
    chosenAssignees = [owner]
  } else if (useGroups) {
    chosenAssignees = chooseUsersFromGroups(
      owner,
      assigneeGroups,
      numberOfAssignees || numberOfReviewers,
      useFoundAssigneeGroup
    )
  } else {
    const candidates = assignees ? assignees : reviewers
    chosenAssignees = chooseUsers(
      candidates,
      numberOfAssignees || numberOfReviewers,
      owner
    )
  }

  return chosenAssignees
}

export function chooseUsers(
  candidates: string[],
  desiredNumber: number,
  filterUser: string = ''
): string[] {
  const filteredCandidates = candidates.filter((reviewer: string): boolean => {
    return reviewer !== filterUser
  })

  // all-assign
  if (desiredNumber === 0) {
    return filteredCandidates
  }

  return _.sampleSize(filteredCandidates, desiredNumber)
}

export function includesSkipKeywords(
  title: string,
  skipKeywords: string[]
): boolean {
  for (const skipKeyword of skipKeywords) {
    if (title.toLowerCase().includes(skipKeyword.toLowerCase()) === true) {
      return true
    }
  }

  return false
}

export function chooseUsersFromGroups(
  owner: string,
  groups: { [key: string]: string[] } | undefined,
  desiredNumber: number,
  ownerGroup: boolean
): string[] {
  let users: string[] = []
  let ownerGroupName: string = ''
  if (ownerGroup) {
    ownerGroupName = foundOwnerGroup(owner, groups)
    if (ownerGroupName !== '') {
      // @ts-ignore
      if (typeof groups[ownerGroupName] != 'undefined') {
        // @ts-ignore
        users = users.concat(
          chooseUsers(groups[ownerGroupName], desiredNumber, owner)
        )
      }
      return users
    }
  }

  for (const group in groups) {
    users = users.concat(chooseUsers(groups[group], desiredNumber, owner))
  }
  return users
}

export function foundOwnerGroup(
  owner: string,
  groups: { [key: string]: string[] } | undefined
): string {
  for (const group in groups) {
    for (const index in groups[group]) {
      const user = groups[group][index]
      if (user === owner) {
        return group
      }
    }
  }
  return ''
}

export async function fetchConfigurationFile(client: github.GitHub, options) {
  const { owner, repo, path, ref } = options
  const result = await client.repos.getContents({
    owner,
    repo,
    path,
    ref,
  })

  const data: any = result.data

  if (!data.content) {
    throw new Error('the configuration file is not found')
  }

  const configString = Buffer.from(data.content, 'base64').toString()
  const config = yaml.safeLoad(configString)

  return config
}
