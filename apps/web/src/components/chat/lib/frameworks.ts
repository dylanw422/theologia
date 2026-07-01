export interface SubTradition {
  id: string;
  label: string;
}

export interface Framework {
  id: string;
  label: string;
  subTraditions: SubTradition[];
}

function sub(id: string, label: string): SubTradition {
  return { id, label };
}

/**
 * The theological traditions Theologia supports at launch, from docs/GOAL.md.
 * Labels use the short display form ("Reformed", not "Reformed / Calvinist") —
 * this audience knows the pairings. Sub-traditions are the optional
 * refinements offered when a user starts a new conversation.
 */
export const FRAMEWORKS: Framework[] = [
  {
    id: "reformed",
    label: "Reformed",
    subTraditions: [
      sub("presbyterian", "Presbyterian"),
      sub("dutch-reformed", "Dutch Reformed"),
      sub("reformed-baptist", "Reformed Baptist"),
      sub("continental-reformed", "Continental Reformed"),
    ],
  },
  {
    id: "lutheran",
    label: "Lutheran",
    subTraditions: [
      sub("confessional-lutheran", "Confessional Lutheran (LCMS)"),
      sub("evangelical-lutheran", "Evangelical Lutheran (ELCA-leaning)"),
    ],
  },
  {
    id: "arminian-wesleyan",
    label: "Arminian",
    subTraditions: [
      sub("classical-arminian", "Classical Arminian"),
      sub("wesleyan-holiness", "Wesleyan-Holiness"),
      sub("open-theism", "Open Theism (flagged)"),
    ],
  },
  {
    id: "roman-catholic",
    label: "Roman Catholic",
    subTraditions: [
      sub("pre-vatican-ii", "Pre-Vatican II Traditionalist"),
      sub("post-vatican-ii", "Post-Vatican II"),
    ],
  },
  {
    id: "eastern-orthodox",
    label: "Eastern Orthodox",
    subTraditions: [
      sub("greek-orthodox", "Greek Orthodox"),
      sub("russian-orthodox", "Russian Orthodox"),
      sub("antiochian", "Antiochian"),
    ],
  },
  {
    id: "baptist",
    label: "Baptist",
    subTraditions: [
      sub("particular-baptist", "Particular Baptist (Reformed)"),
      sub("general-baptist", "General Baptist"),
      sub("southern-baptist", "Southern Baptist"),
    ],
  },
  {
    id: "anglican-episcopal",
    label: "Anglican",
    subTraditions: [
      sub("high-church", "High Church"),
      sub("low-church", "Low Church"),
      sub("broad-church", "Broad Church"),
    ],
  },
  {
    id: "pentecostal-charismatic",
    label: "Pentecostal",
    subTraditions: [
      sub("trinitarian-pentecostal", "Trinitarian Pentecostal"),
      sub("charismatic-evangelical", "Charismatic Evangelical"),
    ],
  },
  {
    id: "oneness-pentecostal",
    label: "Oneness Pentecostal",
    subTraditions: [
      sub("upci-aligned", "UPCI-aligned"),
      sub("apostolic", "Apostolic"),
    ],
  },
  {
    id: "anabaptist-mennonite",
    label: "Anabaptist",
    subTraditions: [
      sub("conservative-mennonite", "Conservative Mennonite"),
      sub("amish-adjacent", "Amish-adjacent"),
      sub("modern-anabaptist", "Modern Anabaptist"),
    ],
  },
  {
    id: "dispensationalist-evangelical",
    label: "Dispensationalist Evangelical",
    subTraditions: [
      sub("classic-dispensationalism", "Classic Dispensationalism"),
      sub("progressive-dispensationalism", "Progressive Dispensationalism"),
    ],
  },
  {
    id: "covenant-theology",
    label: "Covenant Theology (non-Reformed)",
    subTraditions: [sub("new-covenant-theology", "New Covenant Theology")],
  },
];

export function getFramework(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

export function getSubTradition(
  frameworkId: string,
  subId: string,
): SubTradition | undefined {
  return getFramework(frameworkId)?.subTraditions.find((s) => s.id === subId);
}
