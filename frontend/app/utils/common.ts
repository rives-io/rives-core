import { RuleInfo } from "../backend-libs/core/ifaces";

export const SOCIAL_MEDIA_HASHTAGS = ["rives"];


export interface Contest {
  // rule_id:string,
  // start:number,
  // end:number,
  prize:string,
  winner?:string
}

export enum ConstestStatus {
  INVALID,
  NOT_INITIATED,
  IN_PROGRESS,
  FINISHED,
  VALIDATED
}

export const getContestStatus = (rule: RuleInfo): ConstestStatus => {
  if (rule.start == undefined || rule.end == undefined) return ConstestStatus.INVALID;
  const currentTs = Math.floor((new Date()).valueOf()/1000);
  if (currentTs < rule.start) return ConstestStatus.NOT_INITIATED;
  if (currentTs < rule.end) return ConstestStatus.IN_PROGRESS;
  if (rule.n_tapes == rule.n_verified) return ConstestStatus.VALIDATED;
  return ConstestStatus.FINISHED
}
