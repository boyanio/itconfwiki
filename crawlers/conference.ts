export interface Conference {
  url: string;
  name: string;
  startDate: Date;
  endDate: Date;
  keywords: string;
  location: string;
  cfp?: ConferenceCfp;
}

export interface ConferenceCfp {
  deadline: Date;
  expenseSupport: boolean;
  url: string;
}