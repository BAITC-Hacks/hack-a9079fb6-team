/** Shared contract; synchronize changes with docs/contract.md and UI. */
export type MatchRequest = {
  city: string;
  date: string;
  eventType: string;
  category: string;
  budget: number;
  hours?: number;
  language?: string;
  wish?: string;
};
export type Outcome = 'matched' | 'partial' | 'no_category_in_city' | 'none_pass' | 'date_out_of_range';
export type Card = {
  id: string; name: string; categories: string[]; city: string; priceFrom: number;
  synthetic: boolean; priceImputed: boolean; cityImputed: boolean;
  matched: string[]; total: number;
  explanation: string; explanationSource: 'llm' | 'template';
};
export type SuggestionAction = {
  label: string;
  changes: Partial<Pick<MatchRequest, 'date' | 'budget' | 'city'>>;
};
export type MatchResponse = {
  outcome: Outcome;
  message: string;
  cards: Card[];
  funnel: { step: string; left: number; dropped: { reason: string; count: number }[] }[];
  suggestions: string[];
  suggestionActions?: SuggestionAction[];
};
export type CompareResponse = {
  first: MatchResponse;
  second: MatchResponse;
  removed: { id: string; name: string; reason: 'busy' | 'ranking' }[];
};
export type CatalogOptions = { cities: string[]; categories: string[]; eventTypes: string[]; languages: string[] };
