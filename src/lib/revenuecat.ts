import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';

export const REVENUECAT_PREMIUM_ENTITLEMENT_ID = 'premium';

export type RevenueCatSnapshot = {
  configured: boolean;
  appUserId: string | null;
  premiumEntitlementActive: boolean;
  activeEntitlementIds: string[];
};

export type RevenueCatStorePlan = {
  platform: 'ios' | 'android';
  period: 'monthly' | 'annual';
  packageIdentifier: string;
  productIdentifier: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currencyCode: string;
  subscriptionPeriod: string | null;
};

export type RevenueCatPurchaseResult = {
  plan: RevenueCatStorePlan;
  snapshot: RevenueCatSnapshot;
};

const EMPTY_SNAPSHOT: RevenueCatSnapshot = {
  configured: false,
  appUserId: null,
  premiumEntitlementActive: false,
  activeEntitlementIds: [],
};

let configured = false;
let configuredUserId: string | null = null;

function platformApiKey() {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || null;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || null;
  }

  return null;
}

export function revenueCatClientAvailable() {
  return Boolean(platformApiKey()) && (Platform.OS === 'ios' || Platform.OS === 'android');
}

function snapshotFromCustomerInfo(customerInfo: CustomerInfo): RevenueCatSnapshot {
  const activeEntitlementIds = Object.keys(customerInfo.entitlements.active ?? {});

  return {
    configured: true,
    appUserId: configuredUserId,
    premiumEntitlementActive: activeEntitlementIds.includes(
      REVENUECAT_PREMIUM_ENTITLEMENT_ID
    ),
    activeEntitlementIds,
  };
}

function storePlanFromPackage(
  purchasesPackage: PurchasesPackage,
  platform: 'ios' | 'android',
  period: 'monthly' | 'annual'
): RevenueCatStorePlan {
  const product = purchasesPackage.product;

  return {
    platform,
    period,
    packageIdentifier: purchasesPackage.identifier,
    productIdentifier: product.identifier,
    title: product.title,
    description: product.description,
    price: product.price,
    priceString: product.priceString,
    currencyCode: product.currencyCode,
    subscriptionPeriod: product.subscriptionPeriod ?? null,
  };
}

async function currentPackage(period: 'monthly' | 'annual') {
  if (!configured || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    return null;
  }

  const offerings = await Purchases.getOfferings();
  return period === 'monthly'
    ? offerings.current?.monthly ?? null
    : offerings.current?.annual ?? null;
}

function expectedProductId(
  platform: 'ios' | 'android',
  period: 'monthly' | 'annual'
) {
  if (platform === 'ios' && period === 'monthly') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID?.trim() || null;
  }

  if (platform === 'ios' && period === 'annual') {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID?.trim() || null;
  }

  if (platform === 'android' && period === 'monthly') {
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID?.trim() || null;
  }

  return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID?.trim() || null;
}

async function loadPlatformPlan(
  platform: 'ios' | 'android',
  period: 'monthly' | 'annual'
): Promise<RevenueCatStorePlan | null> {
  if (!configured || Platform.OS !== platform) return null;

  const purchasesPackage = await currentPackage(period);
  if (!purchasesPackage) return null;

  const expected = expectedProductId(platform, period);
  if (expected && purchasesPackage.product.identifier !== expected) {
    throw new Error(
      `RevenueCat ${platform} ${period} product mismatch. Expected ${expected}, received ${purchasesPackage.product.identifier}.`
    );
  }

  return storePlanFromPackage(purchasesPackage, platform, period);
}

export async function configureRevenueCatForUser(
  userId: string
): Promise<RevenueCatSnapshot> {
  const cleanUserId = userId.trim();
  const apiKey = platformApiKey();

  if (!cleanUserId || !apiKey || Platform.OS === 'web') {
    return EMPTY_SNAPSHOT;
  }

  if (!configured) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
    }

    Purchases.configure({
      apiKey,
      appUserID: cleanUserId,
    });

    configured = true;
    configuredUserId = cleanUserId;
  } else if (configuredUserId !== cleanUserId) {
    const { customerInfo } = await Purchases.logIn(cleanUserId);
    configuredUserId = cleanUserId;
    return snapshotFromCustomerInfo(customerInfo);
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return snapshotFromCustomerInfo(customerInfo);
}

export async function refreshRevenueCatSnapshot(): Promise<RevenueCatSnapshot> {
  if (!configured || Platform.OS === 'web') {
    return EMPTY_SNAPSHOT;
  }

  const customerInfo = await Purchases.getCustomerInfo();
  return snapshotFromCustomerInfo(customerInfo);
}

export async function loadAppleMonthlyPremiumPlan(): Promise<RevenueCatStorePlan | null> {
  return loadPlatformPlan('ios', 'monthly');
}

export async function loadAppleAnnualPremiumPlan(): Promise<RevenueCatStorePlan | null> {
  return loadPlatformPlan('ios', 'annual');
}

export async function loadGoogleMonthlyPremiumPlan(): Promise<RevenueCatStorePlan | null> {
  return loadPlatformPlan('android', 'monthly');
}

export async function loadGoogleAnnualPremiumPlan(): Promise<RevenueCatStorePlan | null> {
  return loadPlatformPlan('android', 'annual');
}

export async function loadCurrentPremiumPlan(
  period: 'monthly' | 'annual'
): Promise<RevenueCatStorePlan | null> {
  if (Platform.OS === 'ios') return loadPlatformPlan('ios', period);
  if (Platform.OS === 'android') return loadPlatformPlan('android', period);
  return null;
}

export async function purchasePremiumPlan(
  period: 'monthly' | 'annual'
): Promise<RevenueCatPurchaseResult> {
  if (!configured || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    throw new Error('RevenueCat is not configured for this device.');
  }

  const platform = Platform.OS;
  const purchasesPackage = await currentPackage(period);
  if (!purchasesPackage) {
    throw new Error(`RevenueCat ${period} package is not available.`);
  }

  const expected = expectedProductId(platform, period);
  if (expected && purchasesPackage.product.identifier !== expected) {
    throw new Error(
      `RevenueCat ${platform} ${period} product mismatch. Expected ${expected}, received ${purchasesPackage.product.identifier}.`
    );
  }

  const plan = storePlanFromPackage(purchasesPackage, platform, period);
  const { customerInfo } = await Purchases.purchasePackage(purchasesPackage);
  const snapshot = snapshotFromCustomerInfo(customerInfo);

  if (!snapshot.premiumEntitlementActive) {
    throw new Error(
      `Purchase completed but RevenueCat entitlement '${REVENUECAT_PREMIUM_ENTITLEMENT_ID}' is not active.`
    );
  }

  return { plan, snapshot };
}

export async function detachRevenueCatUser() {
  if (!configured || !configuredUserId || Platform.OS === 'web') return;

  try {
    await Purchases.logOut();
  } finally {
    configuredUserId = null;
  }
}

export function emptyRevenueCatSnapshot(): RevenueCatSnapshot {
  return { ...EMPTY_SNAPSHOT };
}
