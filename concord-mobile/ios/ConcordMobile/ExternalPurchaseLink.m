// ExternalPurchaseLink.m
// Objective-C bridge exposing the Swift ExternalPurchaseLink module to React Native.

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ExternalPurchaseLink, NSObject)

RCT_EXTERN_METHOD(open:(NSString *)urlString
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
