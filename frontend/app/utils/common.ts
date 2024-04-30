import { RuleInfo } from "../backend-libs/core/ifaces";

export const SOCIAL_MEDIA_HASHTAGS = [];


export interface Contest {
  // rule_id:string,
  // start:number,
  // end:number,
  prize:string,
  winner?:string
}

export enum ContestStatus {
  INVALID,
  NOT_INITIATED,
  IN_PROGRESS,
  FINISHED,
  VALIDATED
}

export const getContestStatus = (rule: RuleInfo): ContestStatus => {
  if (rule.start == undefined || rule.end == undefined) return ContestStatus.INVALID;
  const currentTs = Math.floor((new Date()).valueOf()/1000);
  if (currentTs < rule.start) return ContestStatus.NOT_INITIATED;
  if (currentTs < rule.end) return ContestStatus.IN_PROGRESS;
  if (rule.n_tapes == rule.n_verified) return ContestStatus.VALIDATED;
  return ContestStatus.FINISHED
}
