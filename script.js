// XML을 JSON으로 변환하는 함수
async function fetchXMLtoJSON(url) {
    try {
        let response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP 오류 ${response.status}`);

        let textData = await response.text();
        console.log("📥 API 응답:", textData);

        let parser = new DOMParser();
        let xml = parser.parseFromString(textData, "application/xml");

        let json = xmlToJson(xml);
        console.log("🚀 변환된 JSON 데이터:", json);

        return json;
    } catch (error) {
        console.error("🚨 API 요청 실패:", error);
        return null;
    }
}

// XML을 JSON으로 변환하는 함수
function xmlToJson(xml) {
    let obj = {};
    if (xml.nodeType == 1) {
        if (xml.attributes.length > 0) {
            obj["@attributes"] = {};
            for (let j = 0; j < xml.attributes.length; j++) {
                let attribute = xml.attributes.item(j);
                obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
            }
        }
    } else if (xml.nodeType == 3) {
        obj = xml.nodeValue.trim();
    }

    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            let item = xml.childNodes.item(i);
            let nodeName = item.nodeName;
            if (typeof obj[nodeName] === "undefined") {
                obj[nodeName] = xmlToJson(item);
            } else {
                if (typeof obj[nodeName].push === "undefined") {
                    let old = obj[nodeName];
                    obj[nodeName] = [];
                    obj[nodeName].push(old);
                }
                obj[nodeName].push(xmlToJson(item));
            }
        }
    }
    return obj;
}

const API_KEY = "QZaklqvKVpzmBpWW4SolKCnjBRjZw15cWSK0UNYnrfzYdHZcYPmvAMIJS1E2SaU%2BOZeITup95X6EjZ%2F5GWe0ZA%3D%3D";

// 🚌 버스 노선 불러오기
async function loadBusRoute() {
    let busRouteId = document.getElementById("bus-select").value;
    console.log("🚌 선택한 노선 ID:", busRouteId);

    let routeContainer = document.getElementById("route-container");
    routeContainer.innerHTML = "<p>🚍 정류장 정보를 불러오는 중...</p>";

    let stations = await getStationList(busRouteId);

    if (!stations.length) {
        routeContainer.innerHTML = "<p>❌ 정류장을 불러오지 못했습니다.</p>";
        return;
    }

    let routeDiv = document.createElement("div");
    routeDiv.classList.add("bus-route");

    stations.forEach((station, index) => {
        let div = document.createElement("div");
        div.classList.add("station");
        div.innerText = station.name;
        div.dataset.index = index;
        routeDiv.appendChild(div);
    });

    routeContainer.innerHTML = "";
    routeContainer.appendChild(routeDiv);
}

// 🚏 정류장 목록 가져오기
async function getStationList(busRouteId) {
    let url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?serviceKey=${API_KEY}&busRouteId=${busRouteId}&_type=json`;

    let data = await fetchXMLtoJSON(url);

    if (!data || !data.ServiceResult || !data.ServiceResult.msgBody || !data.ServiceResult.msgBody.itemList) {
        console.error("🚨 API 응답이 비어 있음.");
        return [];
    }

    let stations = data.ServiceResult.msgBody.itemList.map(station => ({
        name: station.stationNm?.["#text"] || station.stationNm || "정류장 정보 없음",
        seq: station.seq?.["#text"] || station.seq || "0"
    }));

    return stations;
}

// 🚌 실시간 버스 위치 업데이트
async function updateBusPosition(busRouteId, stations) {
    let url = `http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid?serviceKey=${API_KEY}&busRouteId=${busRouteId}&_type=json`;

    try {
        let data = await fetchXMLtoJSON(url);

        if (!data || !data.ServiceResult || !data.ServiceResult.msgBody || !data.ServiceResult.msgBody.itemList) {
            throw new Error("API 응답이 비어 있음 (노선 ID가 올바른지 확인)");
        }

        let buses = data.ServiceResult.msgBody.itemList;
        console.log("🚍 불러온 버스 데이터:", buses);

        document.querySelectorAll(".bus-container").forEach(bus => bus.remove());

        if (!Array.isArray(buses)) {
            buses = [buses];
        }

        buses.forEach(bus => {
            let busSeq = parseInt(bus.sectOrd?.["#text"] || bus.sectOrd, 10) || 0;
            let stationIndex = stations.findIndex(st => st.seq == busSeq);

            if (stationIndex !== -1) {
                let busDiv = document.createElement("div");
                busDiv.classList.add("bus-container");

                let vehId = bus.plainNo?.["#text"] || bus.plainNo || "번호 없음";
                let vehIdNum = vehId.replace(/[^0-9]/g, ""); // 숫자만 추출

                let lowPlate = (bus.busType?.["#text"] == "1" || bus.busType == "1") ? "저상" : "";
                let congestionValue = bus.congetion?.["#text"] || bus.congetion || "0"; // 🚨 `congetion` 사용
                let congestionText = { 0: "정보 없음", 3: "여유", 4: "보통", 5: "혼잡", 6: "매우혼잡" };
                let congestion = congestionText[parseInt(congestionValue, 10)] || "정보 없음";

		console.log("버스 데이터:", bus);


                // 🚀 **차량 유형 (GREENCITY / BS090) 확실히 구분**
                let vehicleType = ""; // 기본값
                if (busRouteId == "114900001") {  
                    if (vehIdNum === "8027" || vehIdNum === "8030") {
                        vehicleType = "GREENCITY"; // ✅ 8027, 8030만 GREENCITY 적용
                    }
                }

                let busImage = (vehIdNum === "8027" || vehIdNum === "8030") ? "image2.png" : "image1.png";

                busDiv.innerHTML = `
                    <div class="bus-info">
                        <div>${vehId}</div>
                        <div>${lowPlate}</div>
                        <div>혼잡도: ${congestion}</div>
                        <div><strong>${vehicleType}</strong></div>
                    </div>
                    <img src="${busImage}" class="bus-image">
                `;

                document.querySelectorAll(".station")[stationIndex].appendChild(busDiv);
            }
        });

    } catch (error) {
        console.error("🚨 실시간 버스 위치 업데이트 실패:", error);
    }
}

// 🔄 20초마다 실시간 업데이트
setInterval(() => {
    let busRouteId = document.getElementById("bus-select").value;
    if (busRouteId) {
        getStationList(busRouteId).then(stations => {
            if (stations.length) updateBusPosition(busRouteId, stations);
        });
    }
}, 5000);

// 제작자 정보 추가
document.addEventListener("DOMContentLoaded", () => {
    let footer = document.createElement("div");
    footer.style.textAlign = "center";
    footer.style.marginTop = "20px";
    footer.innerHTML = "<p>제작자: 오승재,안윤찬,정시우</p>";
    document.body.appendChild(footer);
});
