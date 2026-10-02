import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, type KeyboardEvent } from "react-native";

/**
 * ارتفاعُ الكيبورد الظاهر الآن — يُحشى به أسفلُ الشاشة فيصعد حقلُ الكتابة
 * فوقه بقدره تماماً.
 *
 * `KeyboardAvoidingView` يحسب ما يُغطّى من موضعه **في أبيه** لا في الشاشة،
 * وشاشاتُنا تضعه تحت رأسٍ مرسوم (`ScreenHeader`) — فكان يرفع الحقلَ بأقلّ
 * من الكيبورد بارتفاع الرأس، ويبقى السطرُ الذي يُكتب مغطّى. والحدثُ هنا
 * يقول ارتفاعَ الكيبورد نفسه، فلا حسابَ يُخطئ.
 *
 * وعلى آبل وحدها: «will» يسبق ظهورَ الكيبورد فتتحرّك الشاشةُ معه بمدّته
 * ومنحناه، لا بعده بقفزة. وأندرويد يُصغّر النافذةَ بنفسه (`adjustResize`)،
 * فحشوةٌ فوقه تُضاعف المسافة.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const move = (event: KeyboardEvent, next: number) => {
      LayoutAnimation.configureNext({
        duration: event.duration || 250,
        update: { type: LayoutAnimation.Types.keyboard },
      });
      setHeight(next);
    };
    const show = Keyboard.addListener("keyboardWillShow", (event) =>
      move(event, event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardWillHide", (event) => move(event, 0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
