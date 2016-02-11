// var enableBtn = function() {
// 	document.getElementById("submitInfo").disabled = false;
// 	console.log('this is a test?');
// }

$(function() {
	var uri = window.location.href;
	var index = uri.indexOf('/reset') + 7;
	var token = uri.substring(index, index + 64);

	$('#submitInfo').click(function(e) {
		var newPassword = $('#inputPassword').val();
		var confirmPassword = $('#confirmPassword').val();

		$.ajax({
			method: 'POST',
            contentType: "application/x-www-form-urlencoded",
			data: {
				newPassword: newPassword,
				confirmPassword: confirmPassword
			},
			url: '/api/reset/' + token,
			dataType: 'json',
			success: function(response, textStatus, jqXHR) {
				if (response && response.redirect) {
                    window.location.href = response.redirect;
				}
			}
		});
	});
});