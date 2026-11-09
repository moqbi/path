# قواعدُ هواوي الرسميّة لـHMS Core (القاعدة ٤٤٨): حزمُها تشير إلى فئاتٍ لا توجد إلا على
# أجهزة هواوي (HwTelephonyManager، وhianalytics، وiapfull)، فيسقط R8 بـ«Missing class».
-keepattributes *Annotation*,Exceptions,InnerClasses,Signature,SourceFile,LineNumberTable
-keep class com.huawei.hianalytics.** { *; }
-keep class com.huawei.updatesdk.** { *; }
-keep class com.huawei.hms.** { *; }
-dontwarn com.huawei.**
-dontwarn android.telephony.HwTelephonyManager
