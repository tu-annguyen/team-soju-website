export interface AnniversaryVideo {
  id: string;
  title: string;
}

export interface AnniversaryTeam {
  name: string;
  logo: string;
  score: number;
}

export interface AnniversaryEvent {
  icon: string;
  name: string;
  first?: string;
  second?: string;
  third?: string;
  OT?: string;
  shinyScore?: number;
  score?: number;
}

export interface AnniversaryData {
  contentVideo?: AnniversaryVideo[];
  teams: AnniversaryTeam[];
  mainEvents: AnniversaryEvent[];
  miniEvents: AnniversaryEvent[];
  eventShinies?: AnniversaryEvent[];
  eventBounties?: AnniversaryEvent[];
}
