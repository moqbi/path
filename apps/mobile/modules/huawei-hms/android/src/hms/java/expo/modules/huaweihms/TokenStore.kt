package expo.modules.huaweihms

import android.content.Context

internal object TokenStore {
  private const val FILE = "athar_hms"
  private const val KEY = "push_token"

  fun read(context: Context): String? =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null)

  fun write(context: Context, token: String) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, token).apply()
  }

  fun clear(context: Context) {
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().remove(KEY).apply()
  }
}
