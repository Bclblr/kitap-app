import { supabase } from '@/lib/supabase';

export type HouseAdPlacement = 'story_top' | 'feed' | 'both';
export type HouseAdMediaType = 'image' | 'video';

export type HouseAdCampaign = {
  id: string;
  title: string;
  subtitle: string | null;
  media_type: HouseAdMediaType;
  media_url: string;
  storage_path: string | null;
  target_url: string;
  placement: HouseAdPlacement;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  feed_interval: number;
  priority: number;
  created_at: string;
  updated_at: string;
};

const SELECT =
  'id,title,subtitle,media_type,media_url,storage_path,target_url,placement,active,starts_at,ends_at,feed_interval,priority,created_at,updated_at';

export async function loadActiveHouseAds(): Promise<HouseAdCampaign[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('ad_campaigns')
    .select(SELECT)
    .eq('active', true)
    .lte('starts_at', now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as HouseAdCampaign[];
}

export function adMatchesPlacement(ad: HouseAdCampaign, placement: Exclude<HouseAdPlacement, 'both'>) {
  return ad.placement === placement || ad.placement === 'both';
}

export function pickStoryTopAd(ads: HouseAdCampaign[]) {
  return ads.find((ad) => adMatchesPlacement(ad, 'story_top')) ?? null;
}

export function pickFeedAd(ads: HouseAdCampaign[], feedIndex: number) {
  const eligible = ads.filter(
    (ad) =>
      adMatchesPlacement(ad, 'feed') &&
      feedIndex >= 2 &&
      (feedIndex + 1) % Math.max(3, ad.feed_interval || 6) === 0
  );
  if (!eligible.length) return null;
  return eligible[Math.floor(feedIndex / 3) % eligible.length];
}
