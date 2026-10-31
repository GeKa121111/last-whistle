# LAST WHISTLE — البناء والتحقق

## هيكل المصدر المعتمد

- ملفات التطبيق الموجودة في الجذر هي المصدر الأساسي لواجهة اللعبة وأصول التشغيل: `index.html`، وملفات JavaScript وCSS، و`sw.js`، والأيقونات والبيانات التعريفية.
- `public/` ليست مصدر تطوير مستقلًا؛ إنها نسخة النشر الثابتة التي يُنشئها `scripts/build-static.cjs` من ملفات الجذر. لا تعدّل نسخها يدويًا.
- `source/public/data/` هو المصدر الوحيد لمحركات البيانات ولقطات البيانات المضغوطة.
- `data/` في الجذر و`public/data/` نسختان مولّدتان من `source/public/data/`. ويُنشأ `dist/` من `public/`.
- لا تُحذف ملفات الجذر أو `public/` لمجرد تطابقها؛ ملفات `public/` مطلوبة للنشر، لكن البناء يزامنها آليًا من المصدر الأساسي.

## البناء والتحقق

يتحقق `scripts/build-static.cjs` من وجود جميع ملفات المصدر واللقطات، ثم يزامن ملفات التطبيق من الجذر إلى `public/`، والبيانات من `source/public/data/` إلى `data/` و`public/data/`، ثم ينشئ `dist/`. ويتحقق البناء من تطابق الملفات المنسوخة، بما فيها:

- `snapshots/football-reference.json.gz.b64`
- `snapshots/fifa-global-2023.json.gz.b64`
- `snapshots/openfootball-clubs.json.gz.b64`
- `snapshots/awards.json.gz.b64`

## المتطلبات والتشغيل

Node.js 18 أو أحدث، دون اعتماديات تشغيل خارجية.

```bash
npm test
npm run build
node scripts/assert-static-cache-version.cjs
```

اختبارات الدخان البنيوية لا تغني عن اختبار رحلة لعب كاملة في متصفح فعلي؛ لذلك يشغّل CI أيضًا اختبار Playwright للمتصفح الحقيقي.
