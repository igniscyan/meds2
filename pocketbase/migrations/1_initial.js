// This is just an example migration - modify according to your needs
migrate((db) => {
  // Create collections here
  const collection = new Collection({
    name: 'example',
    type: 'base',
    schema: [
      {
        name: 'title',
        type: 'text',
        required: true,
      },
      {
        name: 'content',
        type: 'text',
      },
    ],
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  // Describe how to revert the changes
  return Dao(db).deleteCollection('example');
});
