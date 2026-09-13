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
  if (!configured || Platform.OS !== 'ios') return null;

  const offerings = await Purchases.getOfferings();
  const monthlyPackage = offerings.current?.monthly ?? null;

  if (!monthlyPackage) return null;

  const expectedProductId =
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_MONTHLY_PRODUCT_ID?.trim() || null;

  if (
    expectedProductId &&
    monthlyPackage.product.identifier !== expectedProductId
  ) {
    throw new Error(
      `RevenueCat Apple monthly product mismatch. Expected ${expectedProductId}, received ${monthlyPackage.product.identifier}.`
    );
  }

  return storePlanFromPackage(monthlyPackage, 'ios', 'monthly');
}

export async function loadAppleAnnualPremiumPlan(): Promise<RevenueCatStorePlan | null> {
  if (!configured || Platform.OS !== 'ios') return null;

  const offerings = await Purchases.getOfferings();
  const annualPackage = offerings.current?.annual ?? null;

  if (!annualPackage) return null;

  const expectedProductId =
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_ANNUAL_PRODUCT_ID?.trim() || null;

  if (
    expectedProductId &&
    annualPackage.product.identifier !== expectedProductId
  ) {
    throw new Error(
      `RevenueCat Apple annual product mismatch. Expected ${expectedProductId}, received ${annualPackage.product.identifier}.`
    );
  }

  return storePlanFromPackage(annualPackage, 'ios', 'annual');
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
