const FUNDING_SOURCES = [
  paypal.FUNDING.PAYPAL,
  paypal.FUNDING.PAYLATER,
  paypal.FUNDING.VENMO,
];

function handleTransactionCases(details) {
  // Three cases to handle:
  //    (1) Recoverable INSTRUMENT_DECLINED -> call actions.restart()
  //    (2) Other non-recoverable errors -> Show a failure message
  //    (3) Successful transaction -> Show confirmation or thank you message

  // This example reads a v2/checkout/orders capture response, propagated from the server
  // You could use a different API or structure for your 'orderData'
  const errorDetail = Array.isArray(details.details) && details.details[0];

  if (errorDetail && errorDetail.issue === "INSTRUMENT_DECLINED") {
    return actions.restart();
    // https://developer.paypal.com/docs/checkout/integration-features/funding-failure/
  }

  if (errorDetail) {
    let msg = "Sorry, your transaction could not be processed.";
    msg += errorDetail.description ? " " + errorDetail.description : "";
    msg += details.debug_id ? " (" + details.debug_id + ")" : "";
    alert(msg);
  }

  const transaction = details.purchase_units[0].payments.captures[0];
  alert("Transaction " + transaction.status + ": " + transaction.id + ". See console for all available details");
}

async function onCreateOrder(data, actions) {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
    });

    const details = await response.json();
    return details.id;
  } catch (error) {
    console.error(error);
  }
}

async function onCaptureOrder(data, actions, orderID) {
  const orderId = data ? data.orderID : orderID;
  
  try {
    const response = await fetch(`/api/orders/${orderId}/capture`, {
      method: "POST",
    });

    const details = await response.json();
    handleTransactionCases(details);
  } catch (error) {
    console.error(error);
  }
}


FUNDING_SOURCES.forEach((fundingSource) => {
  paypal.Buttons({
      fundingSource,
      style: {
        layout: "vertical",
        shape: "rect",
        color: fundingSource === paypal.FUNDING.PAYLATER ? "gold" : "",
      },
      createOrder: async (data, actions) => onCreateOrder(data, actions),
      onApprove: async (data, actions) => onCaptureOrder (data, actions, null),
    })
    .render("#paypal-button-container");
});

// If this returns false or the card fields aren't visible, see Step #1.
if (paypal.HostedFields.isEligible()) {
  let orderId;

  // Renders card fields
  paypal.HostedFields.render({
    // Call your server to set up the transaction
    createOrder: async (data, actions) => {
      orderId = await onCreateOrder(data, actions);
      return orderId;
    },
    styles: {
      ".valid": {
        color: "green",
      },
      ".invalid": {
        color: "red",
      },
    },
    fields: {
      number: {
        selector: "#card-number",
        placeholder: "4111 1111 1111 1111",
      },
      cvv: {
        selector: "#cvv",
        placeholder: "123",
      },
      expirationDate: {
        selector: "#expiration-date",
        placeholder: "MM/YY",
      },
    },
  }).then((cardFields) => {
    document.querySelector("#card-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const { value: cardHolderName } = document.getElementById("card-holder-name");
          const { value: postalCode } = document.getElementById("card-billing-address-zip");
          const { value: countryCodeAlpha2 } = document.getElementById("card-billing-address-country");

          await cardFields.submit({
            cardHolderName,
            billingAddress: {
              postalCode,
              countryCodeAlpha2,
            },
          });

          await onCaptureOrder (null, null, orderId);
        } catch (error) {
          alert("Payment could not be captured! " + JSON.stringify(error));
        }
      });
  });
} else {
  // Hides card fields if the merchant isn't eligible
  document.querySelector("#card-form").style = "display: none";
}