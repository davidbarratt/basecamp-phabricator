const transactions = ( actions ) => (
  actions.reduce( (acc, { type, value }, index) => {
    if ( !Array.isArray( value ) ) {
      return {
        ...acc,
        [ `transactions[${index}][type]` ]: type,
        [ `transactions[${index}][value]` ]: value,
      };
    }

    return {
      ...acc,
      [ `transactions[${index}][type]` ]: type,
      ...value.reduce((acc, v, i) => {
        return {
          ...acc,
          [ `transactions[${index}][value][${i}]` ]: v
        }
      }, {}),
    };
  }, {})
);

module.exports = transactions;
