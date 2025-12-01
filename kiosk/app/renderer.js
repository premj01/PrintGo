const { ipcRenderer } = require("electron");
const QRCode = require("qrcode");
const os = require('os')



const status = document.getElementById("status");

const setQrCode = async (qrData) => {
  const qrContainer = document.getElementById("qr");
  QRCode.toCanvas(qrContainer, qrData, { width: 300 }, function (error) {
    if (error) console.error(error);
    else console.log("QR code generated:", qrData);
  });
}



// function requestPrint() {
//   ipcRenderer.send('print-request', pdfPath);
// }


ipcRenderer.on("status", (event, msg) => {
  status.innerText = msg.text;

})
ipcRenderer.on("SetQRCode", async (event, obj) => {
  if (obj.img !== undefined) {
    document.getElementById("imagetoshow").src = "https://cdn.dribbble.com/userupload/26582295/file/original-63bbdcbb56d15515935dc9c5b5b144d7.gif";
  }
  else {
    await setQrCode(`${obj.url}/kisokRedirect?userSessionNumber=${obj.kioskid}`);
    document.getElementById("kioskID").innerText = `${obj.url}/kisokRedirect?userSessionNumber=${obj.kioskid}`
  }
})












// setQrCode(qrData);
// console.log("function called " + qrData);





// setTimeout(() => {
//   status.textContent = "Downloading job...";
//   setQrCode("hi");
// }, 3000);
// setTimeout(() => {
//   setQrCode("hiifrfsrgsdvjdfvbsfvibsi e feofuinw o egfn orgn ergosbnrgowe  grfer greg ergergerg rgergrg");
//   status.textContent = "Printing...";
// }, 6000);
// setTimeout(() => {
//   status.textContent = "Job completed!";
//   setQrCode(123)
// }, 9000);


