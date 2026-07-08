export interface SubCategory {
  name: string;
  image: string;
}

export interface ParentCategory {
  name: string;
  image: string;
  subCategories: SubCategory[];
}

export const STORE_CATEGORIES: ParentCategory[] = [
  {
    name: "Home Decor",
    image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=300&h=300&fit=crop",
    subCategories: [
      { name: "Iron Decor", image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300&h=300&fit=crop" },
      { name: "Sand Art", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&h=300&fit=crop" },
      { name: "Wall Clocks", image: "https://images.unsplash.com/photo-1563861826100-9cb868fdfb1c?w=300&h=300&fit=crop" },
      { name: "MDF Designs", image: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=300&h=300&fit=crop" }
    ]
  },
  {
    name: "Lifestyle & Fashion",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300&h=300&fit=crop",
    subCategories: [
      { name: "Women’s Apparel", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&h=300&fit=crop" },
      { name: "Jewelry", image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&h=300&fit=crop" },
      { name: "Bed Linen", image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=300&h=300&fit=crop" }
    ]
  },
  {
    name: "Hobby & Crafts",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop",
    subCategories: [
      { name: "DIY Products", image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&h=300&fit=crop" }
    ]
  }
];

