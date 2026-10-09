export const CATEGORIES = [
  { key: 'meat',    label: '肉',   color: '#e03131' },
  { key: 'veg',     label: '菜',   color: '#2f9e44' },
  { key: 'egg',     label: '蛋',   color: '#f08c00' },
  { key: 'side',    label: '小菜', color: '#0c8599' },
  { key: 'fry',     label: '炸物', color: '#e8590c' },
  { key: 'braise',  label: '滷菜', color: '#8b5e3c' },
  { key: 'fruit',   label: '水果', color: '#37b24d' },
  { key: 'dessert', label: '甜點', color: '#c2255c' },
];

export const COLOR_BY_KEY = Object.fromEntries(CATEGORIES.map(c => [c.key, c.color]));

export const DEFAULT_DISH_LIB = {
  meat:    ['三杯G', '咖哩G', '咖哩肉（豬）', '香腸（烤）', '烤G翅', '蜂蜜胡椒豬柳'],
  veg:     ['清炒空心菜', '韭菜花炒透抽', '櫛瓜炒肉片', '清炒花椰菜', '開陽白菜', '水煮茄子', '小魚乾炒豆瓜', '薑炒青江菜', '蕃茄炒蛋', '山藥炒三燴', '豌豆炒肉絲'],
  egg:     ['滷蛋', '茶葉蛋', '煎蛋', '荷包蛋', '菜脯蛋', '玉米炒蛋'],
  side:    ['醃蘿蔔', '豆腐乳', '醬瓜', '泡菜', '涼拌海帶', '甜醬瓜', '榨菜'],
  fry:     ['炸地瓜', '炸雞塊', '炸薯條', '鹽酥雞', '炸春捲', '炸豆腐', '炸鮮奶'],
  braise:  ['滷豆干', '滷海帶', '滷藕片', '涼拌木耳', '滷大腸'],
  fruit:   ['香蕉', '芭樂', '火龍果', '柳丁', '蘋果', '葡萄', '芭蕉', '鳳梨', '番茄', '梨子'],
  dessert: ['蛋糕', '綠豆椪', '紅豆湯', '仙草', '奶酪', '果凍', '銅鑼燒', '饅頭'],
};
