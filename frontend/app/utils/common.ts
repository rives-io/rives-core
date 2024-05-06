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

export const getContestStatusMessage = (status: ContestStatus): string => {
  switch (status) {
    case ContestStatus.IN_PROGRESS:
      return "Open";
    case ContestStatus.NOT_INITIATED:
      return "Upcomming";
    case ContestStatus.FINISHED:
    case ContestStatus.VALIDATED:
      return "Finished";
  
    default:
      return "";
  }
}

export const formatBytes = (bytes: number,decimals?:number): string => {
  if(bytes == 0) return '0 Bytes';
  var k = 1024,
      dm = decimals || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}